import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Film, LayoutGrid, Monitor, Plus, Settings2, WandSparkles, X, ZoomIn, ZoomOut } from 'lucide-react';
import { recipeMap } from './recipes-data';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Slider } from './components/ui/slider';
import { DesignerFlowCanvas } from './components/designer-flow';
import { RecipeThumbnail } from './components/recipe-thumbnail';
import { PreviewTimeline, usePreviewPlayback } from './components/preview-playback';
import { ColorPicker } from './components/ui/color-picker';
import { GradientPicker } from './components/ui/gradient-picker';
import { createSceneDocument, ensureSceneDocument } from './engine/scene-document';
import { createRecipeDocument, ensureRecipeDocument } from './engine/recipe-document';
import { RenderEngine } from './engine/render-engine';
import { applyRecipeTemplate, createRecipeDocumentForTemplate, getRecipeTemplate, recipeTemplates } from './engine/shader-library';
import { applyRecipeToSceneDocument } from './engine/recipe-bridge';
import { ensureRecipeEditorDefaults, getRecipeColorControls, updateRecipeColor } from './engine/recipe-controls';
import { createRecipeLibraryEntry, normalizeRecipeLibrary } from './engine/recipe-library';
import { starterRecipePresets } from './engine/recipe-presets';

const initialScreens = [{ id: 'center', name: 'Center screen', width: 1920, height: 1080, x: 0, y: 0 }];
const tabs = [['layout', 'Layout', LayoutGrid], ['browser', 'Browser', BookOpen], ['designer', 'Designer', WandSparkles], ['editor', 'Editor', Settings2], ['export', 'Export', Film]];
const recipeLibrarySeedVersion = 3;
const sceneDefaults = { blank: { energy: 50, grain: 20 }, default: { energy: 35, grain: 12 } };
function createScene(recipe = 'blank', index = Date.now()) { const defaults = sceneDefaults[recipe] || sceneDefaults.default; const template = getRecipeTemplate(recipe, recipeMap[recipe]?.colors, recipeMap[recipe]?.name); const recipeDocument = { ...createRecipeDocumentForTemplate(template), controls: { energy: defaults.energy } }; const sceneDocument = applyRecipeToSceneDocument(createSceneDocument(), recipeDocument); return { id: `scene-${index}-${Math.random().toString(36).slice(2, 7)}`, recipe, energy: defaults.energy, grain: defaults.grain, sceneDocument, recipeDocument }; }
function ensureLibraryState(state) {
  const library = normalizeRecipeLibrary(state.recipeLibrary);
  const seeded = starterRecipePresets.reduce((entries, preset) => {
    const existing = entries.find(entry => entry.id === preset.id);
    const entry = createRecipeLibraryEntry(preset.document, { id: preset.id, name: preset.name, source: 'official', description: preset.description, createdAt: existing?.createdAt }, entries.filter(item => item.id !== preset.id));
    return existing ? entries.map(item => item.id === preset.id ? entry : item) : [...entries, entry];
  }, library);
  const libraryId = state.playlist.find(scene => scene.id === state.selectedScene)?.recipeLibraryId;
  if (seeded.length) {
    const activeRecipeLibraryId = seeded.some(entry => entry.id === libraryId) ? libraryId : null;
    return { ...state, recipeLibrary: seeded, recipeLibrarySeedVersion, activeRecipeLibraryId };
  }
  const document = ensureRecipeDocument(state.recipeDocument);
  const entry = createRecipeLibraryEntry(document, {}, []);
  return { ...state, recipeLibrary: [entry], recipeLibrarySeedVersion, activeRecipeLibraryId: entry.id };
}
function isOfficialRecipe(entry) { return entry?.source === 'official' || starterRecipePresets.some(preset => preset.id === entry?.id); }
function normalizeState(saved, fallback) {
  const source = saved || fallback;
  const screens = Array.isArray(source.screens) && source.screens.length ? source.screens : initialScreens;
  const [left, center] = screens;
  const untouchedLegacyLayout = screens.length === 2
    && left?.id === 'left' && left.name === 'Left screen'
    && left.width === 1920 && left.height === 1080 && left.x === 0 && left.y === 0
    && center?.id === 'center' && center.name === 'Center screen'
    && center.width === 1920 && center.height === 1080 && center.x === 1944 && center.y === 0;
  const playlist = (source.playlist || ['aurora']).map((scene, index) => {
    if (typeof scene === 'string') return createScene(scene, `legacy-${index}`);
    const recipe = scene.recipe || 'blank';
    return {
      ...(sceneDefaults[recipe] || sceneDefaults.default),
      ...scene,
      recipe,
      id: scene.id || `scene-${index}`,
    };
  });
  const selectedScene = playlist.find(scene => scene.id === source.selectedScene)?.id || playlist[0]?.id;
  const legacyRootDocument = ensureSceneDocument(source.sceneDocument);
  const savedLibrary = Array.isArray(source.recipeLibrary) ? source.recipeLibrary : [];
  const normalizedPlaylist = playlist.map(scene => {
    const template = getRecipeTemplate(scene.recipe, recipeMap[scene.recipe]?.colors, recipeMap[scene.recipe]?.name);
    const libraryRecipe = savedLibrary.find(entry => entry?.id && entry.id === scene.recipeLibraryId)?.recipeDocument;
    const snapshot = scene.recipeDocument ?? libraryRecipe ?? (scene.id === selectedScene ? source.recipeDocument : null);
    const recipeDocument = snapshot ? ensureRecipeDocument(snapshot) : createRecipeDocumentForTemplate(template);
    const energy = Number(snapshot?.controls ? recipeDocument.controls.energy : scene.energy ?? recipeDocument.controls.energy);
    const sceneDocument = scene.sceneDocument
      ? ensureSceneDocument(scene.sceneDocument)
      : scene.id === selectedScene ? legacyRootDocument : createSceneDocument();
    return {
      ...scene,
      energy,
      recipeDocument: { ...recipeDocument, controls: { ...recipeDocument.controls, energy } },
      sceneDocument,
    };
  });
  const active = normalizedPlaylist.find(scene => scene.id === selectedScene) || normalizedPlaylist[0] || createScene('blank', 'active');
  const activeTemplate = getRecipeTemplate(active.recipe, recipeMap[active.recipe]?.colors, recipeMap[active.recipe]?.name);
  const isLegacyScene = !source.sceneDocument || Number(source.sceneDocument.version || 0) < 2;
  const baseScene = isLegacyScene || !active.sceneDocument.layers[0]?.material?.procedural
    ? applyRecipeTemplate(active.sceneDocument, activeTemplate)
    : active.sceneDocument;
  const sceneDocument = applyRecipeToSceneDocument(baseScene, active.recipeDocument);
  return {
    ...source,
    screens: untouchedLegacyLayout ? initialScreens : screens,
    playlist: normalizedPlaylist.map(scene => scene.id === active.id ? { ...scene, sceneDocument } : scene),
    selectedScene: active.id,
    recipe: active.recipe,
    energy: active.energy,
    grain: active.grain,
    sceneTemplate: source.sceneTemplate || activeTemplate.id,
    sceneDocument,
    recipeDocument: active.recipeDocument,
  };
}
function activateScene(state, scene) {
  const libraryEntry = state.recipeLibrary?.find(entry => entry.id === scene.recipeLibraryId);
  const isCustom = scene.recipe === 'custom' || Boolean(libraryEntry);
  const template = isCustom ? null : getRecipeTemplate(scene.recipe, recipeMap[scene.recipe]?.colors, recipeMap[scene.recipe]?.name);
  const snapshot = scene.recipeDocument ?? libraryEntry?.recipeDocument;
  const recipeDocument = snapshot
    ? ensureRecipeDocument(snapshot)
    : createRecipeDocumentForTemplate(template ?? undefined);
  const sceneDocument = applyRecipeToSceneDocument(scene.sceneDocument, recipeDocument);
  const energy = Number(recipeDocument.controls.energy ?? scene.energy ?? 50);
  const recipe = isCustom ? 'custom' : scene.recipe;
  const playlist = state.playlist.map(item => item.id === scene.id
    ? { ...item, recipe, energy, recipeDocument, sceneDocument }
    : item);
  return {
    ...state,
    selectedScene: scene.id,
    activeRecipeLibraryId: libraryEntry?.id || null,
    sceneTemplate: template?.id || 'custom',
    recipe, energy, grain: scene.grain, recipeDocument, sceneDocument, playlist,
  };
}

function selectScene(setState, sceneId) {
  setState(current => {
    const scene = current.playlist.find(item => item.id === sceneId);
    return scene ? activateScene(current, scene) : current;
  });
}
function loadLibraryRecipe(setState, entry) { setState(current => { const recipeDocument = ensureRecipeDocument(entry.recipeDocument); const sceneId = current.selectedScene || current.playlist[0]?.id; const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument ? ensureSceneDocument(current.sceneDocument) : createSceneDocument(), recipeDocument); const energy = Number(recipeDocument.controls?.energy ?? current.energy ?? 50); const playlist = current.playlist.map(scene => scene.id === sceneId ? { ...scene, recipe: 'custom', recipeLibraryId: entry.id, recipeDocument, sceneDocument, energy } : scene); return { ...current, selectedScene: sceneId, recipe: 'custom', activeRecipeLibraryId: entry.id, recipeDocument, sceneDocument, energy, sceneTemplate: 'custom', playlist }; }); }
function appendLibraryScene(current, entry) {
  const recipeDocument = ensureRecipeDocument(entry.recipeDocument);
  const scene = {
    id: `scene-library-${entry.id}-${Date.now()}-${current.playlist.length}`,
    recipe: 'custom',
    recipeLibraryId: entry.id,
    energy: Number(recipeDocument.controls.energy),
    grain: current.grain ?? 12,
    sceneDocument: createSceneDocument(),
    recipeDocument,
  };
  return activateScene({ ...current, playlist: [...current.playlist, scene] }, scene);
}

function addLibraryRecipeToPlaylist(setState, entry) {
  setState(current => appendLibraryScene(current, entry));
}

function remixLibraryRecipe(setState, entry, onNavigate) {
  setState(current => {
    const library = normalizeRecipeLibrary(current.recipeLibrary);
    const remix = createRecipeLibraryEntry(entry.recipeDocument, {
      name: `${entry.name} Remix`,
      source: 'user',
      description: `A user remix of ${entry.name}.`,
    }, library);
    return appendLibraryScene({ ...current, recipeLibrary: [...library, remix] }, remix);
  });
  onNavigate('designer');
}
function addScene(setState, recipe = 'blank') {
  setState(current => {
    const scene = createScene(recipe, current.playlist.length);
    return activateScene({ ...current, playlist: [...current.playlist, scene] }, scene);
  });
}
function patchRecipeDocument(setState, update) { setState(current => { const document = ensureRecipeDocument(current.recipeDocument); const recipeDocument = ensureRecipeDocument(update(document)); const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument, recipeDocument); const playlist = current.playlist.map(scene => scene.id === current.selectedScene ? { ...scene, energy: Number(recipeDocument.controls?.energy ?? scene.energy ?? 50), recipeDocument, sceneDocument } : scene); return { ...current, energy: Number(recipeDocument.controls?.energy ?? current.energy ?? 50), recipeDocument, sceneDocument, playlist }; }); }

function usePersistentState() {
  const fallback = { screens: initialScreens, selected: 'center', layout: 'span', gap: 24, recipe: 'aurora', energy: 35, grain: 12, playlist: ['aurora'], maskOffscreen: true, selectedLayer: 'background', sceneDocument: applyRecipeTemplate(createSceneDocument(), recipeTemplates.aurora), recipeDocument: createRecipeDocument(), selectedRecipeLayer: 'layer-1', selectedRecipeNode: 'node-1', sceneTemplate: 'aurora' };
  const [state, setState] = useState(() => { try { return ensureLibraryState(normalizeState(JSON.parse(localStorage.getItem('display-forge-react')), fallback)); } catch { return ensureLibraryState(normalizeState(fallback, fallback)); } });
  useEffect(() => { const migratedPlaylist = state.playlist.map(scene => { const template = getRecipeTemplate(scene.recipe, recipeMap[scene.recipe]?.colors, recipeMap[scene.recipe]?.name); const hasOutput = scene.recipeDocument?.layers?.some(layer => layer.nodes?.some(node => node.type === 'output')); const hasOpaqueModule = scene.recipeDocument?.layers?.some(layer => layer.nodes?.some(node => node.type === 'module')); const recipeDocument = scene.recipeDocument && Number(scene.recipeDocument.version || 0) >= 2 && hasOutput && !hasOpaqueModule ? ensureRecipeDocument(scene.recipeDocument) : createRecipeDocumentForTemplate(template); const sceneDocument = applyRecipeToSceneDocument(scene.sceneDocument, recipeDocument); return { ...scene, recipeDocument, sceneDocument }; }); const active = migratedPlaylist.find(scene => scene.id === state.selectedScene) || migratedPlaylist[0]; if (!active) return; const changed = migratedPlaylist.some((scene, index) => scene.recipeDocument !== state.playlist[index]?.recipeDocument || scene.sceneDocument !== state.playlist[index]?.sceneDocument); if (!changed) return; setState(current => ({ ...current, recipeDocument: active.recipeDocument, sceneDocument: active.sceneDocument, playlist: migratedPlaylist })); }, []);
  useEffect(() => { if (state.recipeLibrarySeedVersion === recipeLibrarySeedVersion) return; const migrated = ensureLibraryState(state); const currentIds = normalizeRecipeLibrary(state.recipeLibrary).map(entry => entry.id).join('|'); const nextIds = migrated.recipeLibrary.map(entry => entry.id).join('|'); if (currentIds !== nextIds || state.recipeLibrarySeedVersion !== recipeLibrarySeedVersion) setState(current => ({ ...current, recipeLibrary: migrated.recipeLibrary, recipeLibrarySeedVersion, activeRecipeLibraryId: current.activeRecipeLibraryId || migrated.activeRecipeLibraryId })); }, [state.recipeLibrarySeedVersion]);
  useEffect(() => { const timer = window.setTimeout(() => localStorage.setItem('display-forge-react', JSON.stringify(state)), 150); return () => window.clearTimeout(timer); }, [state]);
  return [state, setState];
}


function DraggableNumberInput({ value, onValueChange, min, max, step = 1, ...props }) {
  const drag = useRef(null);
  const clamp = next => Math.max(min === undefined ? -Infinity : Number(min), Math.min(max === undefined ? Infinity : Number(max), next));
  const onPointerDown = event => { if (event.button !== 0) return; drag.current = { startX: event.clientX, startY: event.clientY, startValue: Number(value) || 0 }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); };
  const onPointerMove = event => { if (!drag.current) return; const horizontalDelta = event.clientX - drag.current.startX; const verticalDelta = drag.current.startY - event.clientY; const delta = Math.round((horizontalDelta + verticalDelta) / 6); const next = clamp(drag.current.startValue + delta * Number(step)); onValueChange(String(next)); };
  const onPointerUp = event => { drag.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); };
  return <Input {...props} type="number" min={min} max={max} step={step} value={value} className="draggable-number" onChange={event => onValueChange(event.target.value)} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />;
}

function Preview({ state, setState, playback, sceneName, audition, onEndAudition }) {
  const canvasRef = useRef(null); const engineRef = useRef(null); const dragRef = useRef(null); const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }); const [rendererError, setRendererError] = useState(''); const bounds = { width: Math.max(...state.screens.map(s => s.x + s.width)), height: Math.max(...state.screens.map(s => s.y + s.height)) }; const maskOn = state.maskOffscreen !== false;
  const previewRecipe = audition?.recipeDocument ?? state.recipeDocument;
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return undefined; try { engineRef.current = new RenderEngine(canvas); setRendererError(''); } catch (error) { engineRef.current = null; setRendererError(error instanceof Error ? error.message : 'The preview renderer could not start.'); } return () => { engineRef.current?.dispose(); engineRef.current = null; }; }, []);
  useEffect(() => { let frame; const baseSceneDocument = ensureSceneDocument(state.sceneDocument); const recipeDocument = ensureRecipeDocument(previewRecipe); const draw = () => { const time = playback.timeRef.current; const currentSceneDocument = applyRecipeToSceneDocument(baseSceneDocument, recipeDocument, time); engineRef.current?.render(currentSceneDocument, time); frame = requestAnimationFrame(draw); }; frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame); }, [state.sceneDocument, previewRecipe, playback.timeRef]);
  const zoomBy = amount => setView(current => ({ ...current, zoom: Math.max(.5, Math.min(3, Number((current.zoom * amount).toFixed(2)))) })); const fit = () => setView({ zoom: 1, x: 0, y: 0 }); const pointerDown = event => { if (event.target.closest('.screen-outline, .timeline')) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y }; }; const pointerMove = event => { if (!dragRef.current) return; const drag = dragRef.current; setView(current => ({ ...current, x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY })); }; const pointerUp = () => { dragRef.current = null; }; const wheel = event => { if (event.target.closest('.timeline')) return; event.preventDefault(); zoomBy(event.deltaY < 0 ? 1.1 : .9); };
  return <section className="preview-panel"><div className="preview-head"><div><span className="eyebrow">{state.layout === 'span' ? 'Extended canvas' : 'Separate feeds'}</span><h2>Stage preview</h2><p className="preview-scene-name">Active scene · {sceneName}</p>{audition && <p className="preview-audition">Auditioning · {audition.name}</p>}</div><div className="preview-actions">{audition && <Button variant="outline" size="sm" onClick={onEndAudition}>Back to scene preview</Button>}<Button variant="ghost" size="icon" title="Zoom out" onClick={() => zoomBy(.9)}><ZoomOut size={15} /></Button><Button variant="ghost" size="sm" onClick={fit}>{Math.round(view.zoom * 100)}%</Button><Button variant="ghost" size="icon" title="Zoom in" onClick={() => zoomBy(1.1)}><ZoomIn size={15} /></Button><Button variant={maskOn ? 'secondary' : 'ghost'} size="sm" onClick={() => setState(s => ({ ...s, maskOffscreen: !maskOn }))}>{maskOn ? 'Mask on' : 'Mask off'}</Button></div></div><div className="canvas-wrap" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel}><div className="preview-stage" style={{ aspectRatio: `${bounds.width} / ${bounds.height}`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}><svg className="preview-defs" aria-hidden="true"><defs><clipPath id="screen-content-clip" clipPathUnits="objectBoundingBox">{state.screens.map(screen => <rect key={screen.id} x={screen.x / bounds.width} y={screen.y / bounds.height} width={screen.width / bounds.width} height={screen.height / bounds.height} />)}</clipPath></defs></svg><canvas ref={canvasRef} style={{ clipPath: maskOn ? 'url(#screen-content-clip)' : 'none' }} />{rendererError && <div className="renderer-error" role="alert">Preview unavailable: {rendererError}</div>}<div className="screen-layer">{state.screens.map(screen => <Button variant="ghost" size="sm" key={screen.id} className={`screen-outline ${screen.id === state.selected ? 'selected' : ''}`} style={{ left: `${screen.x / bounds.width * 100}%`, top: `${screen.y / bounds.height * 100}%`, width: `${screen.width / bounds.width * 100}%`, height: `${screen.height / bounds.height * 100}%` }} onClick={() => setState(s => ({ ...s, selected: screen.id }))}><span>{screen.name}</span></Button>)}</div></div><small className="preview-hint">Drag to pan · Scroll to zoom</small><span className="resolution">{bounds.width.toLocaleString()} × {bounds.height.toLocaleString()} px</span><PreviewTimeline className="compact" playback={playback} /></div></section>;
}

function ScreenSettings({ state, setState }) { const selected = state.screens.find(s => s.id === state.selected) || state.screens[0]; const update = (key, value) => setState(s => ({ ...s, screens: s.screens.map(screen => screen.id === selected.id ? { ...screen, [key]: key === 'name' ? value : Number(value) } : screen) })); return <><PanelTitle eyebrow="Project" title="Screen planner" sub="Configure the project canvas and see the active recipe in place." /><Panel title="Project layout"><div className="segmented"><Button variant="ghost" size="sm" className={state.layout === 'span' ? 'active' : ''} onClick={() => setState(s => ({ ...s, layout: 'span' }))}>One canvas</Button><Button variant="ghost" size="sm" className={state.layout === 'separate' ? 'active' : ''} onClick={() => setState(s => ({ ...s, layout: 'separate' }))}>Separate feeds</Button></div><div className="screen-list">{state.screens.map(screen => <Button variant="ghost" size="sm" className={screen.id === state.selected ? 'screen-row active' : 'screen-row'} key={screen.id} onClick={() => setState(s => ({ ...s, selected: screen.id }))}><Monitor size={15} /><span>{screen.name}</span><small>{screen.width} × {screen.height}</small></Button>)}</div><Button variant="outline" className="full" onClick={() => setState(s => ({ ...s, screens: [...s.screens, { id: `screen-${Date.now()}`, name: `Screen ${s.screens.length + 1}`, width: 1920, height: 1080, x: Math.max(...s.screens.map(x => x.x + x.width)) + s.gap, y: 0 }] }))}><Plus size={14} /> Add a screen</Button><Field label="Space between screens" value={state.gap} suffix="px" onChange={v => setState(s => ({ ...s, gap: Number(v) }))} /></Panel><Panel title="Selected screen"><Field label="Screen name" value={selected.name} onChange={v => update('name', v)} /><Field label="Width" value={selected.width} suffix="px" onChange={v => update('width', v)} /><Field label="Height" value={selected.height} suffix="px" onChange={v => update('height', v)} /><div className="two-col"><Field label="Position X" value={selected.x} onChange={v => update('x', v)} /><Field label="Position Y" value={selected.y} onChange={v => update('y', v)} /></div></Panel></>; }

function Playlist({ state, setState, horizontal = false, onSceneAction }) {
  const items = (state.playlist || []).map(scene => {
    const libraryEntry = state.recipeLibrary?.find(entry => entry.id === scene.recipeLibraryId);
    const recipeDocument = scene.recipeDocument ?? libraryEntry?.recipeDocument;
    const recipe = libraryEntry
      ? { id: libraryEntry.id, name: libraryEntry.name, category: 'library', description: libraryEntry.description }
      : recipeMap[scene.recipe] || (recipeDocument ? { id: 'custom', name: recipeDocument.name || 'Custom recipe', category: 'custom', description: recipeDocument.description || '' } : null);
    return recipe ? { scene, recipe, recipeDocument } : null;
  }).filter(Boolean);
  const remove = id => setState(current => {
    const playlist = current.playlist.filter(scene => scene.id !== id);
    if (!playlist.length) return { ...current, playlist: [], selectedScene: null, sceneDocument: ensureSceneDocument(null), recipeDocument: ensureRecipeDocument(null), activeRecipeLibraryId: null };
    if (current.selectedScene !== id) return { ...current, playlist };
    return activateScene({ ...current, playlist }, playlist[0]);
  });
  const content = items.length ? items.map(({ scene, recipe, recipeDocument }) => <div className={`playlist-row ${scene.id === state.selectedScene ? 'active' : ''}`} key={scene.id} onClick={() => { selectScene(setState, scene.id); onSceneAction?.(); }}><RecipeThumbnail recipeDocument={recipeDocument} className="playlist-thumbnail" /><span><strong>{recipe.name}</strong><small>{recipe.category} · {scene.energy}% energy</small></span><Button variant="ghost" size="icon" aria-label={`Remove ${recipe.name} from playlist`} onClick={event => { event.stopPropagation(); remove(scene.id); onSceneAction?.(); }}><X size={14} /></Button></div>) : <p className="muted">Add a scene or create a recipe in Designer.</p>;
  const addButton = <Button variant="outline" size="icon" className="playlist-add" aria-label="Add scene" title="Add scene" onClick={() => { addScene(setState); onSceneAction?.(); }}><Plus size={18} /></Button>;
  return horizontal ? <section className="playlist-strip" aria-label="Playlist"><span className="playlist-strip-title">Playlist · {items.length}</span><div className="playlist-list">{content}</div>{addButton}</section> : <Panel title={`Playlist · ${items.length}`}><div className="playlist-list">{content}</div>{addButton}</Panel>;
}
function Browser({ state, setState, onNavigate, audition, onAudition }) {
  const library = useMemo(() => normalizeRecipeLibrary(state.recipeLibrary), [state.recipeLibrary]);
  const official = library.filter(isOfficialRecipe);
  const user = library.filter(entry => !isOfficialRecipe(entry));
  const selected = audition || official[0] || user[0];
  const hasActiveScene = state.playlist.some(scene => scene.id === state.selectedScene);

  const commit = action => {
    action();
    onAudition(null);
  };
  const grid = entries => entries.length ? (
    <div className="recipe-browser-grid">
      {entries.map(entry => (
        <article className={`recipe-browser-card ${audition?.id === entry.id ? 'selected' : ''}`} key={entry.id}>
          <button type="button" className="recipe-browser-card-select" aria-pressed={audition?.id === entry.id}
            onClick={() => onAudition(entry.id)}>
            <RecipeThumbnail recipeDocument={entry.recipeDocument} className="recipe-browser-thumbnail" />
            <span className="recipe-browser-card-copy"><strong>{entry.name}</strong><small>{entry.description}</small></span>
            <span className="recipe-browser-source">{isOfficialRecipe(entry) ? 'Official' : 'You'}</span>
          </button>
        </article>
      ))}
    </div>
  ) : <p className="muted">No recipes here yet.</p>;

  return (
    <>
      <PanelTitle eyebrow="Recipe library" title="Browser" sub="Click a recipe to audition it on the stage." />
      {selected && (
        <Panel title={audition ? 'Selected recipe' : 'Featured recipe'}>
          <div className="recipe-browser-feature">
            <RecipeThumbnail recipeDocument={selected.recipeDocument} className="recipe-browser-featured-thumbnail" />
            <div className="recipe-browser-feature-copy">
              <span className="recipe-browser-source-label">{isOfficialRecipe(selected) ? 'Official Library' : 'User Library'}</span>
              <strong>{selected.name}</strong>
              <p>{selected.description || 'Reusable Display Forge recipe.'}</p>
              <div className="recipe-browser-feature-actions">
                {!audition && <Button variant="outline" size="sm" onClick={() => onAudition(selected.id)}>Preview recipe</Button>}
                <Button size="sm" disabled={!hasActiveScene}
                  onClick={() => commit(() => loadLibraryRecipe(setState, selected))}>Apply to current scene</Button>
                <Button variant="outline" size="sm" onClick={() => commit(() => addLibraryRecipeToPlaylist(setState, selected))}>
                  <Plus size={13} /> Add to playlist
                </Button>
                <Button variant="outline" size="sm" onClick={() => commit(() => remixLibraryRecipe(setState, selected, onNavigate))}>
                  <WandSparkles size={13} /> Remix in Designer
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      )}
      <Panel title={`Official Library · ${official.length}`}>{grid(official)}</Panel>
      <Panel title={`User Library · ${user.length}`}>{grid(user)}</Panel>
    </>
  );
}

function Editor({ state, setState, onNavigate }) {
  const recipeDocument = ensureRecipeDocument(state.recipeDocument);
  useEffect(() => { if (!recipeDocument.controls?.defaultsInitialized) patchRecipeDocument(setState, current => ensureRecipeEditorDefaults(current)); }, [recipeDocument.controls?.defaultsInitialized]);
  const colorControls = getRecipeColorControls(recipeDocument);
  const energy = Math.max(0, Math.min(100, Number(recipeDocument.controls?.energy ?? 50)));
  const energyDefault = Math.max(0, Math.min(100, Number(recipeDocument.controls?.energyDefault ?? 50)));
  const updateEnergy = value => patchRecipeDocument(setState, current => ({ ...current, controls: { ...current.controls, energy: Math.max(0, Math.min(100, Number(value))) } }));
  const updateColor = (control, value) => patchRecipeDocument(setState, current => updateRecipeColor(current, control, value));
  const resetColor = control => updateColor(control, control.defaultValue);
  return <><PanelTitle eyebrow="Recipe controls" title="Editor" sub="Adjust the main controls for the active recipe. Open Designer when you need the full graph." /><Button variant="outline" className="full editor-designer-link" onClick={() => onNavigate?.('designer')}>Customize in Designer</Button>
    <Panel title="Energy"><Range label="Energy" value={energy} onChange={updateEnergy} onReset={() => updateEnergy(energyDefault)} /><p className="muted">Drives the speed and motion of the recipe together.</p></Panel>
    <Panel title="Color"><p className="muted">These colors come directly from the active recipe nodes.</p>{colorControls.length ? colorControls.map(control => <div className="field" key={control.controlId}><span className="editor-param-label"><span>{control.label}</span><ResetButton label={control.label} onReset={() => resetColor(control)} /></span>{control.kind === 'ramp' || control.kind === 'gradient' ? <GradientPicker value={control.value} showAngle={control.kind !== 'ramp'} onChange={value => updateColor(control, value)} /> : <ColorPicker value={control.value} onChange={value => updateColor(control, value)} />}</div>) : <p className="muted">This recipe has no editable color parameters.</p>}</Panel>
  </>;
}
function PanelTitle({ eyebrow, title, sub }) { return <div className="panel-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{sub}</p></div>; }
function Panel({ title, children }) { return <Card as="section" className="sidebar-card">{title && <CardHeader className="p-4 pb-3"><CardTitle className="flex items-center justify-between text-xs font-semibold tracking-[.01em]"><span>{title}</span><Settings2 size={14} className="text-muted-foreground" /></CardTitle></CardHeader>}<CardContent className={title ? 'p-4 pt-0' : 'p-4'}>{children}</CardContent></Card>; }
function Field({ label, value, suffix, onChange }) { return <label className="field"><span>{label}{suffix && <small>{suffix}</small>}</span>{typeof value === 'number' ? <DraggableNumberInput value={value} onValueChange={onChange} /> : <Input type="text" value={value} onChange={e => onChange(e.target.value)} />}</label>; }
function ResetButton({ label, onReset }) { return <button type="button" className="editor-param-reset" aria-label={`Reset ${label}`} title={`Reset ${label}`} onClick={event => { event.preventDefault(); event.stopPropagation(); onReset(); }}>↺</button>; }
function Range({ label, value, onChange, onReset }) { return <label className="range-field"><span><span>{label}<output>{value}%</output></span>{onReset && <ResetButton label={label} onReset={onReset} />}</span><Slider min={0} max={100} value={[value]} onValueChange={([next]) => onChange(next)} /></label>; }

export default function App() {
  const [state, setState] = usePersistentState();
  const [tab, setTab] = useState('layout');
  const [auditionId, setAuditionId] = useState(null);
  const playback = usePreviewPlayback();
  const audition = tab === 'browser' ? state.recipeLibrary?.find(entry => entry.id === auditionId) : null;
  const endAudition = () => setAuditionId(null);
  const activeScene = state.playlist.find(scene => scene.id === state.selectedScene);
  const sceneName = activeScene
    ? activeScene.name || recipeMap[state.recipe]?.name || state.recipeDocument?.name || 'Untitled scene'
    : 'No scene selected';
  const [exitPanel, setExitPanel] = useState(null);
  const [exitDirection, setExitDirection] = useState('');
  const panels = {
    layout: <ScreenSettings state={state} setState={setState} />,
    browser: <Browser state={state} setState={setState} onNavigate={setTab} audition={audition} onAudition={setAuditionId} />,
    editor: <Editor state={state} setState={setState} onNavigate={setTab} />,
    export: <>
      <PanelTitle eyebrow="Project output" title="Export video" sub="Prepare the active recipe and screen layout for output." />
      <Panel title="Current recipe">
        <p className="muted">Export will use the active recipe graph and project canvas. Your current state is saved locally.</p>
        <Button><Plus size={14} /> Save project</Button>
      </Panel>
    </>,
  };
  const currentPanel = panels[tab];

  const handleTabChange = nextTab => {
    if (tab === 'browser' && nextTab !== tab) endAudition();
    if (nextTab !== tab && (nextTab === 'export' || tab === 'export')) {
      setExitPanel(currentPanel);
      setExitDirection(nextTab === 'export' ? 'exit-left' : 'exit-right');
      window.setTimeout(() => setExitPanel(null), 380);
    }
    setTab(nextTab);
  };
  const showPlaylist = ['browser', 'editor', 'export'].includes(tab);
  const layoutClass = tab === 'export' ? 'export-layout' : tab === 'designer' ? 'designer-layout' : 'standard-layout';

  return (
    <div className="app-shell">
      <header>
        <div className="brand">
          <span className="brand-mark">d</span><span>display forge</span><small>Sunday morning setup</small>
        </div>
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            {tabs.map(([id, label, Icon]) => (
              <TabsTrigger key={id} value={id}><Icon size={14} />{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="saved-pill"><span /> Saved locally</span>
      </header>
      <main className={layoutClass}>
        {exitPanel && <div className={`export-sidebar-exit ${exitDirection}`} aria-hidden="true">{exitPanel}</div>}
        <aside>{currentPanel && <div key={tab} className="tab-panel-enter">{currentPanel}</div>}</aside>
        <div className="preview-column">
          {tab === 'designer' ? <DesignerFlowCanvas state={state} setState={setState} playback={playback} sceneName={sceneName} /> : (
            <>
              <Preview state={state} setState={setState} playback={playback} sceneName={sceneName} audition={audition} onEndAudition={endAudition} />
              <div className={`playlist-slot ${showPlaylist ? 'is-visible' : ''}`}>
                <Playlist state={state} setState={setState} horizontal onSceneAction={endAudition} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
