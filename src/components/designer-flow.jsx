import { useEffect, useMemo, useRef, useState } from 'react';
import { Background, BaseEdge, Controls, EdgeLabelRenderer, Handle, Panel, Position, ReactFlow, SelectionMode, applyNodeChanges, getSmoothStepPath, useUpdateNodeInternals } from '@xyflow/react';
import { BookOpen, Box, ChevronDown, ChevronRight, Copy, GitMerge, Hand, Layers, Lock, MousePointer2, Palette, Plus, Redo2, Save, Settings2, SlidersHorizontal, Trash2, Undo2, Unlock, WandSparkles } from 'lucide-react';
import { Button } from './ui/button';
import { ColorPicker } from './ui/color-picker';
import { GradientPicker } from './ui/gradient-picker';
import { createGraphNode, getParameterMetadata, getPortType, graphNodeTypes, nodeCategories, nodeDefinitions, nodeDescriptions, validateGraphConnection } from '../graph/recipe-graph';
import { ensureSceneDocument } from '../engine/scene-document';
import { createRecipeDocument, ensureRecipeDocument } from '../engine/recipe-document';
import { createRecipeLibraryEntry, generateRecipeName, normalizeRecipeLibrary } from '../engine/recipe-library';
import { RecipeThumbnail } from './recipe-thumbnail';
import { PreviewTimeline } from './preview-playback';
import { RenderEngine } from '../engine/render-engine';
import { applyRecipeToSceneDocument, evaluateDesignerPreview } from '../engine/recipe-bridge';
import '@xyflow/react/dist/style.css';

function portClass(type) { return type === 'scalar' ? 'rf-port-scalar' : type === 'enum' ? 'rf-port-enum' : 'rf-port-color'; }
function inputSummary(node) { const definition = nodeDefinitions[node.type] || {}; const ports = Object.entries(definition.inputs || (definition.input ? { input: definition.input } : {})); return ports.length ? ports.map(([name]) => name).join(' · ') : 'nothing'; }
function mainEdgeId(edge) { return `${edge.from}-${edge.to}-${edge.toPort || 'input'}`; }
function parameterEdgeId(edge) { return `${edge.fromNode}-${edge.toNode}-${edge.toParam}`; }
const NODE_CLIPBOARD_TYPE = 'application/x-display-forge-nodes';
function cloneGraphData(value) { return JSON.parse(JSON.stringify(value)); }
function insertionInput(nodeType) { const definition = nodeDefinitions[nodeType] || {}; const entries = Object.entries(definition.inputs || (definition.input ? { input: definition.input } : {})); if (entries.length === 1) return entries[0]; return entries.find(([name]) => name === 'base') || null; }
function connectionInput(nodeType, sourceType) { const definition = nodeDefinitions[nodeType] || {}; const entries = Object.entries(definition.inputs || (definition.input ? { input: definition.input } : {})); return entries.find(([, type]) => type === sourceType) || insertionInput(nodeType); }
function insertableNodeTypes(layer, edge) { const source = layer.nodes.find(node => node.id === edge.from); const target = layer.nodes.find(node => node.id === edge.to); if (!source || !target) return []; const sourceType = getPortType(source, 'output'); const targetType = getPortType(target, edge.toPort || 'input'); return graphNodeTypes.filter(type => !['background', 'output'].includes(type)).filter(type => { const candidateInput = insertionInput(type); const candidate = { type }; return candidateInput && candidateInput[1] === sourceType && getPortType(candidate, 'output') === targetType; }); }
function connectableNodeTypes(layer, sourceId) { const source = layer.nodes.find(node => node.id === sourceId); if (!source) return []; const sourceType = getPortType(source, 'output'); return graphNodeTypes.filter(type => !['background', 'output'].includes(type)).filter(type => { const candidateInput = connectionInput(type, sourceType); const candidate = { type }; return candidateInput && candidateInput[1] === sourceType && getPortType(candidate, 'output'); }); }
function removeNodeAndReconnect(layer, nodeId) { const removed = layer.nodes.find(node => node.id === nodeId); if (!removed || ['background', 'output'].includes(removed.type)) return layer; const incoming = layer.connections.filter(edge => edge.to === nodeId); const outgoing = layer.connections.filter(edge => edge.from === nodeId); const connections = layer.connections.filter(edge => edge.from !== nodeId && edge.to !== nodeId); const occupiedTargets = new Set(connections.map(edge => `${edge.to}:${edge.toPort || 'input'}`)); outgoing.forEach(outgoingEdge => { const target = layer.nodes.find(node => node.id === outgoingEdge.to); if (!target) return; const targetPort = outgoingEdge.toPort || 'input'; const targetType = getPortType(target, targetPort); const match = incoming.find(incomingEdge => { const source = layer.nodes.find(node => node.id === incomingEdge.from); return source && getPortType(source, 'output') === targetType && !occupiedTargets.has(`${target.id}:${targetPort}`); }); if (!match) return; connections.push({ from: match.from, to: target.id, toPort: targetPort }); occupiedTargets.add(`${target.id}:${targetPort}`); }); return { ...layer, nodes: layer.nodes.filter(node => node.id !== nodeId), connections, parameterConnections: layer.parameterConnections.filter(edge => edge.fromNode !== nodeId && edge.toNode !== nodeId) }; }
function snapNodePosition(nodes, nodeId, position) { const moving = nodes.find(node => node.id === nodeId); if (!moving || !position) return position; const grid = 20; const threshold = 12; const width = moving.measured?.width || moving.width || 218; const height = moving.measured?.height || moving.height || 110; let x = Math.round(position.x / grid) * grid; let y = Math.round(position.y / grid) * grid; const xCandidates = []; const yCandidates = []; nodes.filter(node => node.id !== nodeId).forEach(node => { const otherWidth = node.measured?.width || node.width || 218; const otherHeight = node.measured?.height || node.height || 110; xCandidates.push(node.x, node.x + (otherWidth - width) / 2, node.x + otherWidth - width); yCandidates.push(node.y, node.y + (otherHeight - height) / 2, node.y + otherHeight - height); }); const nearest = (value, candidates) => { const match = candidates.map(candidate => ({ candidate, distance: Math.abs(candidate - value) })).sort((a, b) => a.distance - b.distance)[0]; return match && match.distance <= threshold ? match.candidate : value; }; return { x: nearest(x, xCandidates), y: nearest(y, yCandidates) }; }
function flowEdgeMatches(edge, flowEdge, kind = 'main') { if (!flowEdge) return false; if (flowEdge.id && (kind === 'parameter' ? parameterEdgeId(edge) : mainEdgeId(edge)) === flowEdge.id) return true; if (kind === 'parameter') return edge.fromNode === flowEdge.source && edge.toNode === flowEdge.target && edge.toParam === String(flowEdge.targetHandle || '').replace(/^param:/, ''); return edge.from === flowEdge.source && edge.to === flowEdge.target && (edge.toPort || 'input') === (flowEdge.targetHandle || 'input'); }
function removeFlowEdge(layer, flowEdge) { const kind = flowEdge?.data?.kind || ((flowEdge?.targetHandle || '').startsWith('param:') ? 'parameter' : 'main'); if (kind === 'parameter') return { ...layer, parameterConnections: layer.parameterConnections.filter(edge => !flowEdgeMatches(edge, flowEdge, 'parameter')) }; return { ...layer, connections: layer.connections.filter(edge => !flowEdgeMatches(edge, flowEdge, 'main')) }; }
function removeFlowEdgeById(layer, edgeId) { const isParameter = layer.parameterConnections.some(edge => parameterEdgeId(edge) === edgeId); return removeFlowEdge(layer, { id: edgeId, data: { kind: isParameter ? 'parameter' : 'main' } }); }
function occupiedEdgeForHandle(layer, handle) {
  if (!handle?.nodeId || !handle?.handleId) return null;
  if (handle.handleType === 'source') return null;
  if (handle.handleType === 'target') {
    if (handle.handleId.startsWith('param:')) {
      const toParam = handle.handleId.slice(6);
      const edge = layer.parameterConnections.find(item => item.toNode === handle.nodeId && item.toParam === toParam);
      return edge ? { id: parameterEdgeId(edge), data: { kind: 'parameter' } } : null;
    }
    const edge = layer.connections.find(item => item.to === handle.nodeId && (item.toPort || 'input') === handle.handleId);
    return edge ? { id: mainEdgeId(edge), data: { kind: 'main' } } : null;
  }
  const parameterEdge = layer.parameterConnections.find(item => item.fromNode === handle.nodeId);
  if (parameterEdge) return { id: parameterEdgeId(parameterEdge), data: { kind: 'parameter' } };
  const mainEdge = layer.connections.find(item => item.from === handle.nodeId);
  return mainEdge ? { id: mainEdgeId(mainEdge), data: { kind: 'main' } } : null;
}
function CategorizedNodeMenu({ candidates, title, onSelect, onClose }) { return <div className="rf-edge-menu nodrag nopan"> <div className="rf-edge-menu-head"><span>{title}</span>{onClose && <button type="button" aria-label="Close add node menu" onClick={event => { event.stopPropagation(); onClose(); }}>×</button>}</div>{candidates.length ? nodeCategories.map(category => { const categoryCandidates = category.types.filter(type => candidates.includes(type)); if (!categoryCandidates.length) return null; return <div className="rf-edge-menu-category" key={category.id}><button type="button" className="rf-edge-menu-category-trigger" onClick={event => event.stopPropagation()}>{category.label}<ChevronRight size={12} /></button><div className="rf-edge-submenu">{categoryCandidates.map(type => <button type="button" key={type} onClick={() => onSelect(type)}>{nodeDefinitions[type]?.label || type}</button>)}</div></div>; }) : <small>No compatible nodes</small>}</div>; }
function InsertEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) { const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 12 }); const candidates = data?.candidates || []; return <><BaseEdge id={id} path={edgePath} /><EdgeLabelRenderer><div className="rf-edge-insert" style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }} onClick={event => { event.stopPropagation(); data.onSelect(id); }}><button type="button" className="rf-edge-add nodrag nopan" aria-label="Insert node" onClick={event => { event.stopPropagation(); data.onSelect(id); data.onToggle(id); }}>+</button>{data.openEdgeId === id && <CategorizedNodeMenu candidates={candidates} title="Insert node" onSelect={type => data.onInsert(id, type)} />}</div></EdgeLabelRenderer></>; }
function ConnectionAddMenu({ menu, onInsert, onClose }) { if (!menu) return null; return <EdgeLabelRenderer><div className="rf-connection-add-menu nodrag nopan" style={{ transform: `translate(${menu.position.x}px,${menu.position.y}px)` }}><CategorizedNodeMenu candidates={menu.candidates} title="Add node" onSelect={onInsert} onClose={onClose} /></div></EdgeLabelRenderer>; }
const edgeTypes = { insert: InsertEdge };
function RecipeNode({ id, data, selected }) {
  const { node, connectedParams, previewing, onDelete } = data;
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(true);
  const updateNodeInternals = useUpdateNodeInternals();
  const definition = nodeDefinitions[node.type] || {};
  const params = Object.entries(node.params || {});
  const visibleParams = propertiesCollapsed ? params.filter(([name]) => connectedParams?.has(name)) : params;
  const visiblePortIds = visibleParams.map(([name]) => name).join(',');
  const inputPorts = Object.entries(definition.inputs || (definition.input ? { input: definition.input } : {}));
  const isProtected = node.type === 'background' || node.type === 'output';
  const outputType = getPortType(node, 'output');
  const displayValue = value => {
    if (value && typeof value === 'object') return value.type;
    return typeof value === 'number' ? value.toFixed(2) : value;
  };

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, visiblePortIds, updateNodeInternals]);

  return (
    <div className={`rf-recipe-node${selected ? ' is-selected' : ''}${previewing ? ' is-previewing' : ''}${isProtected ? ' is-structural' : ''}`}
      title={nodeDescriptions[node.type]}>
      <div className="rf-node-head">
        <span>{node.type}</span>
        <div className="rf-node-actions">
          {params.length > (connectedParams?.size || 0) && (
            <button type="button" className="rf-node-collapse nodrag nopan" aria-expanded={!propertiesCollapsed}
              aria-label={`${propertiesCollapsed ? 'Expand' : 'Collapse'} properties for ${node.name}`}
              title={propertiesCollapsed ? 'Show all properties' : 'Hide unconnected properties'}
              onClick={event => { event.stopPropagation(); setPropertiesCollapsed(value => !value); }}>
              {propertiesCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          {!isProtected && <button type="button" onClick={onDelete} aria-label={`Delete ${node.name}`}>×</button>}
        </div>
      </div>
      <small className="rf-node-description">{nodeDescriptions[node.type]}</small>
      <div className="rf-node-io">
        <span className="rf-node-input-list">
          {inputPorts.length ? inputPorts.map(([name, type], index) => (
            <span className="rf-node-port-label" key={name}>
              {index > 0 && <span className="rf-node-port-separator">·</span>}{name}
              <Handle type="target" position={Position.Left} id={name} className={`rf-main-handle rf-inline-handle ${portClass(type)}`} />
            </span>
          )) : '—'}
        </span>
        <span className="rf-node-output-label">
          {outputType || '—'}
          {outputType && <Handle type="source" position={Position.Right} id="output" className={`rf-main-handle rf-inline-handle ${portClass(outputType)}`} />}
        </span>
      </div>
      {visibleParams.length > 0 && (
        <div className="rf-node-params">
          {visibleParams.map(([name, value]) => (
            <div className="rf-node-param" key={name}>
              {definition.params?.[name] && (
                <Handle type="target" position={Position.Left} id={`param:${name}`}
                  className={`rf-param-handle ${portClass(definition.params[name])}`} />
              )}
              <span>{name}</span><b>{displayValue(value)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const nodeTypes = { recipe: RecipeNode };

const categoryIcons = { structure: Layers, sources: Box, fields: WandSparkles, color: Palette, composition: GitMerge, effects: Settings2, advanced: SlidersHorizontal };
function GraphToolbar({ interactionMode, onInteractionModeChange, categories, addableNodeTypes, onAdd, onUndo, onRedo, canUndo, canRedo }) {
  const [openCategory, setOpenCategory] = useState(null);
  return <Panel position="top-center" className="rf-graph-toolbar"><div className="rf-graph-toolbar-row"><div className="rf-graph-tool-group" aria-label="Canvas tools"><Button variant={interactionMode === 'select' ? 'secondary' : 'ghost'} size="icon" title="Select tool" aria-label="Select tool" aria-pressed={interactionMode === 'select'} onClick={() => onInteractionModeChange('select')}><MousePointer2 size={14} /></Button><Button variant={interactionMode === 'pan' ? 'secondary' : 'ghost'} size="icon" title="Pan tool" aria-label="Pan tool" aria-pressed={interactionMode === 'pan'} onClick={() => onInteractionModeChange('pan')}><Hand size={14} /></Button></div><div className="rf-graph-toolbar-divider" /><div className="rf-graph-tool-group rf-graph-node-categories" aria-label="Add node by category">{categories.map(category => { const Icon = categoryIcons[category.id] || Box; const nodes = category.types.filter(type => addableNodeTypes.includes(type)); const isOpen = openCategory === category.id; return <div className="rf-toolbar-category-wrap" key={category.id}><Button variant={isOpen ? 'secondary' : 'ghost'} size="icon" className="rf-toolbar-category-icon" aria-label={`Add ${category.label} node`} aria-expanded={isOpen} title={`Add ${category.label} node`} onClick={() => setOpenCategory(current => current === category.id ? null : category.id)}><Icon size={14} /></Button>{isOpen && <div className="rf-toolbar-category-menu" role="menu" aria-label={`${category.label} nodes`}>{nodes.map(type => <button type="button" role="menuitem" key={type} onClick={() => { onAdd(type); setOpenCategory(null); }}><Icon size={12} /><span>{nodeDefinitions[type]?.label || type}</span></button>)}</div>}</div>; })}</div><div className="rf-graph-toolbar-divider" /><div className="rf-graph-tool-group"><Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo"><Undo2 size={13} /></Button><Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo"><Redo2 size={13} /></Button></div></div></Panel>;
}

function RecipeLibraryControls({ state, setState }) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const library = normalizeRecipeLibrary(state.recipeLibrary);
  const activeEntry = library.find(entry => entry.id === state.activeRecipeLibraryId);

  useEffect(() => {
    const name = state.recipeDocument?.name || '';
    setNameDraft(/^untitled recipe$/i.test(name) ? '' : name);
  }, [state.activeRecipeLibraryId, state.recipeDocument?.name]);

  const save = () => setState(current => {
    const entries = normalizeRecipeLibrary(current.recipeLibrary);
    const existing = entries.find(entry => entry.id === current.activeRecipeLibraryId);
    const document = ensureRecipeDocument({ ...current.recipeDocument, name: nameDraft.trim() || current.recipeDocument?.name });
    const entry = createRecipeLibraryEntry(document, {
      id: existing?.id,
      name: nameDraft.trim() || existing?.name,
      createdAt: existing?.createdAt,
    }, entries.filter(item => item.id !== existing?.id));
    const recipeLibrary = existing ? entries.map(item => item.id === existing.id ? entry : item) : [...entries, entry];
    const recipeDocument = entry.recipeDocument;
    const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument, recipeDocument);
    const playlist = current.playlist.map(scene => scene.id === current.selectedScene ? { ...scene, recipe: 'custom', recipeLibraryId: entry.id, recipeDocument, sceneDocument, energy: Number(recipeDocument.controls?.energy ?? scene.energy ?? 50) } : scene);
    return { ...current, recipe: 'custom', activeRecipeLibraryId: entry.id, recipeDocument, sceneDocument, playlist, energy: Number(recipeDocument.controls?.energy ?? current.energy ?? 50), sceneTemplate: 'custom', recipeLibrary };
  });

  const create = () => setState(current => {
    const recipeDocument = ensureRecipeDocument({ ...createRecipeDocument(), name: 'Untitled recipe', description: 'A reusable Display Forge recipe.' });
    const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument, recipeDocument);
    const playlist = current.playlist.map(scene => scene.id === current.selectedScene ? { ...scene, recipe: 'custom', recipeLibraryId: null, recipeDocument, sceneDocument, energy: Number(recipeDocument.controls?.energy ?? scene.energy ?? 50) } : scene);
    return { ...current, recipe: 'custom', activeRecipeLibraryId: null, recipeDocument, sceneDocument, playlist, energy: Number(recipeDocument.controls?.energy ?? current.energy ?? 50), sceneTemplate: 'custom' };
  });

  const load = id => setState(current => {
    const entry = current.recipeLibrary?.find(item => item.id === id);
    if (!entry) return current;
    const recipeDocument = ensureRecipeDocument(entry.recipeDocument);
    const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument, recipeDocument);
    const playlist = current.playlist.map(scene => scene.id === current.selectedScene ? { ...scene, recipe: 'custom', recipeLibraryId: entry.id, recipeDocument, sceneDocument, energy: Number(recipeDocument.controls?.energy ?? scene.energy ?? 50) } : scene);
    return { ...current, recipe: 'custom', activeRecipeLibraryId: entry.id, recipeDocument, sceneDocument, playlist, energy: Number(recipeDocument.controls?.energy ?? current.energy ?? 50), sceneTemplate: 'custom' };
  });

  const duplicate = id => setState(current => {
    const source = current.recipeLibrary?.find(item => item.id === id);
    if (!source) return current;
    const entry = createRecipeLibraryEntry({ ...ensureRecipeDocument(source.recipeDocument), name: 'Untitled recipe' }, {}, normalizeRecipeLibrary(current.recipeLibrary));
    return { ...current, recipeLibrary: [...normalizeRecipeLibrary(current.recipeLibrary), entry] };
  });

  const remove = id => setState(current => ({ ...current, recipeLibrary: normalizeRecipeLibrary(current.recipeLibrary).filter(entry => entry.id !== id), activeRecipeLibraryId: current.activeRecipeLibraryId === id ? null : current.activeRecipeLibraryId }));

  const generateName = () => setNameDraft(generateRecipeName(state.recipeDocument, library.filter(entry => entry.id !== activeEntry?.id).map(entry => entry.name)));

  return <div className="recipe-library-controls">
    <Button variant="outline" size="sm" onClick={() => setOpen(value => !value)} aria-expanded={open}><BookOpen size={13} /> Library <span className="recipe-library-count">{library.length}</span></Button>
    <Button size="sm" onClick={save}><Save size={13} /> Save recipe</Button>
    <Button variant="ghost" size="icon" onClick={create} aria-label="New recipe" title="New recipe"><Plus size={14} /></Button>
    {open && <div className="recipe-library-popover">
      <div className="recipe-library-popover-head"><div><span className="rf-preview-kicker">Recipe library</span><strong>{library.length} saved recipe{library.length === 1 ? '' : 's'}</strong></div><button type="button" aria-label="Close recipe library" onClick={() => setOpen(false)}>×</button></div>
      <div className="recipe-library-name-field"><label htmlFor="recipe-library-name">Recipe name</label><div><input id="recipe-library-name" value={nameDraft} placeholder="Auto-generate from style" onChange={event => setNameDraft(event.target.value)} /><Button variant="outline" size="icon" className="recipe-library-generate" aria-label="Auto-generate recipe name" title="Auto-generate recipe name" onClick={generateName}><WandSparkles size={13} /></Button><Button size="sm" onClick={save}>Save</Button></div></div>
      <div className="recipe-library-list">{library.length ? library.map(entry => <div className={`recipe-library-row ${entry.id === activeEntry?.id ? 'active' : ''}`} key={entry.id}><button type="button" className="recipe-library-row-main" onClick={() => load(entry.id)}><RecipeThumbnail recipeDocument={entry.id === state.activeRecipeLibraryId ? state.recipeDocument : entry.recipeDocument} className="recipe-library-thumbnail" /><span><strong>{entry.name}</strong><small>{entry.description}</small></span></button><div className="recipe-library-row-actions"><button type="button" aria-label={`Duplicate ${entry.name}`} title="Duplicate" onClick={event => { event.stopPropagation(); duplicate(entry.id); }}><Copy size={12} /></button><button type="button" aria-label={`Delete ${entry.name}`} title="Delete" onClick={event => { event.stopPropagation(); remove(entry.id); }}><Trash2 size={12} /></button></div></div>) : <p className="muted">No saved recipes yet.</p>}</div>
    </div>}
  </div>;
}

function RecipePreview({ playback, recipeDocument, layer, sceneDocument, previewNodeId, selectedNodeId, previewMode, lockedNodeId, onPreviewModeChange, onToggleCurrentLock }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const resizeRef = useRef(null);
  const [size, setSize] = useState({ width: 286, height: 162 });
  const aspect = 16 / 9;
  const previewNode = layer.nodes.find(node => node.id === previewNodeId);
  const evaluation = useMemo(
    () => evaluateDesignerPreview(sceneDocument, recipeDocument, 0, previewNodeId),
    [sceneDocument, recipeDocument, previewNodeId],
  );
  const hasPreview = evaluation.document.layers.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    try {
      engineRef.current = new RenderEngine(canvas);
    } catch {
      engineRef.current = null;
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);
  const { timeRef } = playback;
  useEffect(() => {
    let frame;
    const draw = () => {
      const time = timeRef.current;
      const { document } = evaluateDesignerPreview(sceneDocument, recipeDocument, time, previewNodeId);
      engineRef.current?.render(document, time);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [recipeDocument, previewNodeId, sceneDocument, timeRef]);
  const beginResize = event => { event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); resizeRef.current = { startX: event.clientX, startWidth: size.width }; };
  const resize = event => { if (!resizeRef.current) return; const nextWidth = Math.max(220, Math.min(1000, resizeRef.current.startWidth + resizeRef.current.startX - event.clientX)); setSize({ width: nextWidth, height: Math.round(nextWidth / aspect) }); };
  const endResize = event => { resizeRef.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); };
  const modeButton = (mode, label) => { const isCurrent = mode === 'current'; const isActive = previewMode === mode; const isLocked = isCurrent ? Boolean(lockedNodeId) : isActive; const lockLabel = isCurrent ? (isLocked ? 'Unlock current node preview' : 'Lock current node preview') : 'Preview output node'; return <div className={`rf-preview-mode${isActive ? ' is-active' : ''}`}><button type="button" className="rf-preview-mode-select nodrag nopan" aria-pressed={isActive} onClick={event => { event.stopPropagation(); onPreviewModeChange(mode); }}><span>{label}</span></button><button type="button" className="rf-preview-mode-lock nodrag nopan" aria-label={lockLabel} title={lockLabel} disabled={isCurrent && !selectedNodeId} onClick={event => { event.stopPropagation(); if (isCurrent) { if (lockedNodeId) onToggleCurrentLock(null); else { onToggleCurrentLock(selectedNodeId); onPreviewModeChange('current'); } } else onPreviewModeChange('output'); }}>{isLocked ? <Lock size={11} /> : <Unlock size={11} />}</button></div>; };
  return <div className="rf-preview-card" style={{ width: size.width, height: size.height + 42 }}><button type="button" className="rf-preview-resize-handle nodrag nopan" aria-label="Resize preview" onPointerDown={beginResize} onPointerMove={resize} onPointerUp={endResize} onPointerCancel={endResize} /><div className="rf-preview-head"><div><span className="rf-preview-kicker">{previewNode ? 'Selected node' : 'Final output'}</span><strong>{previewNode?.name || 'Recipe Output'}</strong></div><div className="rf-preview-head-actions"><div className="rf-preview-mode-list">{modeButton('output', 'Output node')}{modeButton('current', 'Current node')}</div></div></div><div className={`rf-preview-canvas${hasPreview ? '' : ' is-empty'}`}><canvas ref={canvasRef} />{!hasPreview && <span>{evaluation.errors[0] || 'Connect a node to Output'}</span>}</div><PreviewTimeline className="designer-preview-timeline" playback={playback} /></div>;
}

function InspectorParam({ node, name, value, onUpdate }) {
  const definition = nodeDefinitions[node.type] || {};
  const type = definition.params?.[name];
  const metadata = getParameterMetadata(node.type, name);
  const header = <span><span>{metadata.label || name}</span>{typeof value === 'number' && Number.isFinite(value) && <output>{Number(value).toFixed(2)}</output>}</span>;
  const help = <small className="rf-inspector-help">{metadata.description}</small>;
  if (type === 'color') return <label className="rf-inspector-field" title={metadata.description}>{header}{help}<ColorPicker value={value || '#172426'} onChange={next => onUpdate(name, next)} /></label>;
  if (type === 'enum') return <label className="rf-inspector-field" title={metadata.description}>{header}{help}<select value={value} onChange={event => onUpdate(name, event.target.value)}>{(definition.options?.[name] || []).map(option => <option key={option}>{option}</option>)}</select></label>;
  if (typeof value === 'string' && value.startsWith('#')) return <label className="rf-inspector-field" title={metadata.description}>{header}{help}<ColorPicker value={value} onChange={next => onUpdate(name, next)} /></label>;
  if (typeof value !== 'number' || !Number.isFinite(value)) return <div className="rf-inspector-field" title={metadata.description}>{header}{help}<output>{String(value ?? '')}</output></div>;
  const min = metadata.min ?? -10;
  const max = metadata.max ?? 10;
  const sliderValue = Math.max(min, Math.min(max, Number(value)));
  return <label className="rf-inspector-field" title={metadata.description}>{header}{help}<input type="range" min={min} max={max} step={metadata.step ?? 0.01} value={sliderValue} onChange={event => onUpdate(name, Number(event.target.value))} /></label>;
}

function RecipeInspector({ layer, selectedNodeId, onUpdate }) {
  const node = layer?.nodes.find(item => item.id === selectedNodeId);
  if (!node) return null;
  const params = node.type === 'background' ? (node.params.default || {}) : node.params;
  if (node.type === 'background' && params.type === 'gradient') {
    const value = { from: params.colorA || '#172426', to: params.colorB || '#D8F27B', angle: params.angle || 0 };
    const update = gradient => onUpdate(node.id, { default: { ...params, type: 'gradient', colorA: gradient.from, colorB: gradient.to, angle: gradient.angle } });
    return <div className="rf-inspector-card"><span className="rf-preview-kicker">Selected gradient</span><strong>{node.name}</strong><p className="rf-inspector-description">{nodeDescriptions[node.type]}</p><div className="rf-inspector-io"><span>Accepts: {inputSummary(node)}</span><span>Outputs: {getPortType(node, 'output') || 'nothing'}</span></div><GradientPicker value={value} onChange={update} /><small className="rf-inspector-help">Color A sets the start color. Color B sets the end color. Angle controls the gradient direction.</small></div>;
  }
  if (node.type === 'gradient') {
    const value = { from: params.colorA || '#172426', to: params.colorB || '#D8F27B', angle: params.angle || 0 };
    const update = gradient => onUpdate(node.id, { colorA: gradient.from, colorB: gradient.to, angle: gradient.angle });
    return <div className="rf-inspector-card"><span className="rf-preview-kicker">Selected node</span><strong>{node.name}</strong><p className="rf-inspector-description">{nodeDescriptions[node.type]}</p><div className="rf-inspector-io"><span>Accepts: {inputSummary(node)}</span><span>Outputs: {getPortType(node, 'output') || 'nothing'}</span></div><GradientPicker value={value} onChange={update} /><small className="rf-inspector-help">Color A sets the start color. Color B sets the end color. Angle controls the gradient direction.</small>{Object.entries(params).filter(([name]) => !['colorA', 'colorB', 'angle'].includes(name)).map(([name, value]) => <InspectorParam key={name} node={node} name={name} value={value} onUpdate={(key, next) => onUpdate(node.id, { [key]: next })} />)}</div>;
  }
  if (node.type === 'ramp' && typeof params.colorA === 'string' && typeof params.colorB === 'string') {
    const value = { from: params.colorA, to: params.colorB, angle: 90 };
    const update = gradient => onUpdate(node.id, { colorA: gradient.from, colorB: gradient.to });
    return <div className="rf-inspector-card"><span className="rf-preview-kicker">Selected color ramp</span><strong>{node.name}</strong><p className="rf-inspector-description">{nodeDescriptions[node.type]}</p><div className="rf-inspector-io"><span>Accepts: {inputSummary(node)}</span><span>Outputs: {getPortType(node, 'output') || 'nothing'}</span></div><GradientPicker value={value} showAngle={false} onChange={update} /><small className="rf-inspector-help">Color A is used for low scalar values. Color B is used for high scalar values. Midpoint controls where the colors meet.</small>{Object.entries(params).filter(([name]) => !['colorA', 'colorB'].includes(name)).map(([name, value]) => <InspectorParam key={name} node={node} name={name} value={value} onUpdate={(key, next) => onUpdate(node.id, { [key]: next })} />)}</div>;
  }
  return <div className="rf-inspector-card"><span className="rf-preview-kicker">Selected node</span><strong>{node.name}</strong><p className="rf-inspector-description">{nodeDescriptions[node.type]}</p><div className="rf-inspector-io"><span>Accepts: {inputSummary(node)}</span><span>Outputs: {getPortType(node, 'output') || 'nothing'}</span></div>{Object.entries(params).map(([name, value]) => <InspectorParam key={name} node={node} name={name} value={value} onUpdate={(key, next) => onUpdate(node.id, { [key]: next })} />)}</div>;
}

export function DesignerFlowCanvas({ state, setState, playback, sceneName }) {
  const recipeDocument = useMemo(() => ensureRecipeDocument(state.recipeDocument), [state.recipeDocument]);
  const layer = recipeDocument.layers[0]; const sceneDocument = ensureSceneDocument(state.sceneDocument); const selectedNodeId = layer.nodes.some(node => node.id === state.selectedRecipeNode) ? state.selectedRecipeNode : null; const [previewMode, setPreviewMode] = useState('output'); const [lockedNodeId, setLockedNodeId] = useState(null); const previewNodeId = previewMode === 'current' ? (lockedNodeId || selectedNodeId) : null; const [validation, setValidation] = useState(''); const [interactionMode, setInteractionMode] = useState('select'); const [openEdgeId, setOpenEdgeId] = useState(null); const [connectionMenu, setConnectionMenu] = useState(null); const [flow, setFlow] = useState(null); const [selectedEdgeIds, setSelectedEdgeIds] = useState(() => new Set()); const clipboardRef = useRef(null); const pasteCounterRef = useRef(0); const historyRef = useRef({ past: [], future: [] }); const connectionStartRef = useRef(null);
  const updateLayer = (update, recordHistory = true) => setState(current => { const currentDocument = ensureRecipeDocument(current.recipeDocument); const nextDocument = { ...currentDocument, layers: currentDocument.layers.map(item => item.id === layer.id ? update(item) : item) }; if (recordHistory && JSON.stringify(currentDocument) !== JSON.stringify(nextDocument)) { historyRef.current.past = [...historyRef.current.past, currentDocument].slice(-50); historyRef.current.future = []; } const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument, nextDocument); const playlist = current.playlist.map(scene => scene.id === current.selectedScene ? { ...scene, recipeDocument: nextDocument, sceneDocument } : scene); return { ...current, recipeDocument: nextDocument, sceneDocument, playlist }; });
  const updateNodeParams = (nodeId, params) => updateLayer(current => ({ ...current, nodes: current.nodes.map(node => node.id === nodeId ? { ...node, params: { ...node.params, ...params } } : node) }));
  const undo = () => setState(current => { const previous = historyRef.current.past.pop(); if (!previous) return current; historyRef.current.future.unshift(ensureRecipeDocument(current.recipeDocument)); const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument, previous); const playlist = current.playlist.map(scene => scene.id === current.selectedScene ? { ...scene, recipeDocument: previous, sceneDocument } : scene); return { ...current, recipeDocument: previous, sceneDocument, playlist }; });
  const redo = () => setState(current => { const next = historyRef.current.future.shift(); if (!next) return current; historyRef.current.past.push(ensureRecipeDocument(current.recipeDocument)); const sceneDocument = applyRecipeToSceneDocument(current.sceneDocument, next); const playlist = current.playlist.map(scene => scene.id === current.selectedScene ? { ...scene, recipeDocument: next, sceneDocument } : scene); return { ...current, recipeDocument: next, sceneDocument, playlist }; });
  const removeNode = id => updateLayer(current => removeNodeAndReconnect(current, id));
  const selectedNodesForClipboard = () => layer.nodes.filter(node => (node.selected || node.id === state.selectedRecipeNode) && !['background', 'output'].includes(node.type));
  const pasteNodes = payload => { if (!Array.isArray(payload?.nodes) || !payload.nodes.length) return; const offset = 40 + (pasteCounterRef.current++ % 6) * 20; const idMap = new Map(); const pastedNodes = payload.nodes.map((node, index) => { const id = `node-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`; idMap.set(node.id, id); return { ...cloneGraphData(node), id, x: (Number(node.x) || 0) + offset, y: (Number(node.y) || 0) + offset, selected: true }; }); const pastedConnections = (payload.connections || []).filter(edge => idMap.has(edge.from) && idMap.has(edge.to)).map(edge => ({ ...cloneGraphData(edge), from: idMap.get(edge.from), to: idMap.get(edge.to) })); const pastedParameterConnections = (payload.parameterConnections || []).filter(edge => idMap.has(edge.fromNode) && idMap.has(edge.toNode)).map(edge => ({ ...cloneGraphData(edge), fromNode: idMap.get(edge.fromNode), toNode: idMap.get(edge.toNode) })); updateLayer(current => ({ ...current, nodes: current.nodes.map(node => ({ ...node, selected: false })).concat(pastedNodes), connections: [...current.connections, ...pastedConnections], parameterConnections: [...current.parameterConnections, ...pastedParameterConnections] })); setSelectedEdgeIds(new Set()); setState(current => ({ ...current, selectedRecipeNode: pastedNodes[0].id })); };
  useEffect(() => { const isEditableTarget = target => target?.matches?.('input, textarea, select, [contenteditable="true"]'); const serialize = payload => JSON.stringify({ type: NODE_CLIPBOARD_TYPE, payload }); const copyPayload = payload => { clipboardRef.current = payload; try { globalThis.navigator?.clipboard?.writeText(serialize(payload)); } catch {} }; const onCopy = event => { if (isEditableTarget(event.target)) return; const payload = selectedNodesForClipboard(); if (!payload.length) return; const clipboardPayload = { nodes: payload.map(cloneGraphData), connections: layer.connections.filter(edge => payload.some(node => node.id === edge.from) && payload.some(node => node.id === edge.to)).map(cloneGraphData), parameterConnections: layer.parameterConnections.filter(edge => payload.some(node => node.id === edge.fromNode) && payload.some(node => node.id === edge.toNode)).map(cloneGraphData) }; copyPayload(clipboardPayload); try { event.clipboardData?.setData(NODE_CLIPBOARD_TYPE, JSON.stringify(clipboardPayload)); event.clipboardData?.setData('text/plain', serialize(clipboardPayload)); } catch {} event.preventDefault(); event.stopImmediatePropagation(); }; const onPaste = event => { if (isEditableTarget(event.target)) return; const custom = event.clipboardData?.getData(NODE_CLIPBOARD_TYPE); const text = event.clipboardData?.getData('text/plain'); let parsed = null; try { parsed = JSON.parse(custom || text || ''); } catch {} const payload = parsed?.type === NODE_CLIPBOARD_TYPE ? parsed.payload : parsed?.nodes ? parsed : clipboardRef.current; if (!payload?.nodes?.length) return; event.preventDefault(); event.stopImmediatePropagation(); pasteNodes(payload); }; const onKeyDown = event => { if (isEditableTarget(event.target) || !(event.metaKey || event.ctrlKey)) return; if (event.key.toLowerCase() !== 'c') return; const payload = selectedNodesForClipboard(); if (!payload.length) return; const clipboardPayload = { nodes: payload.map(cloneGraphData), connections: layer.connections.filter(edge => payload.some(node => node.id === edge.from) && payload.some(node => node.id === edge.to)).map(cloneGraphData), parameterConnections: layer.parameterConnections.filter(edge => payload.some(node => node.id === edge.fromNode) && payload.some(node => node.id === edge.toNode)).map(cloneGraphData) }; event.preventDefault(); event.stopImmediatePropagation(); copyPayload(clipboardPayload); }; window.addEventListener('copy', onCopy, true); window.addEventListener('paste', onPaste, true); window.addEventListener('keydown', onKeyDown, true); return () => { window.removeEventListener('copy', onCopy, true); window.removeEventListener('paste', onPaste, true); window.removeEventListener('keydown', onKeyDown, true); }; }, [layer.nodes, layer.connections, layer.parameterConnections, state.selectedRecipeNode]);
  useEffect(() => { if (lockedNodeId && !layer.nodes.some(node => node.id === lockedNodeId)) setLockedNodeId(null); }, [layer.nodes, lockedNodeId]);
  useEffect(() => { const onKeyDown = event => { if (!['Backspace', 'Delete'].includes(event.key)) return; const target = event.target; if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return; if (selectedEdgeIds.size) { event.preventDefault(); event.stopImmediatePropagation(); updateLayer(current => [...selectedEdgeIds].reduce((nextLayer, id) => removeFlowEdgeById(nextLayer, id), current), true); setSelectedEdgeIds(new Set()); return; } const selectedNodes = layer.nodes.filter(node => node.selected || node.id === state.selectedRecipeNode).filter(node => !['background', 'output'].includes(node.type)); if (!selectedNodes.length) return; event.preventDefault(); event.stopImmediatePropagation(); updateLayer(current => selectedNodes.reduce((nextLayer, node) => removeNodeAndReconnect(nextLayer, node.id), current)); setState(current => ({ ...current, selectedRecipeNode: null })); }; window.addEventListener('keydown', onKeyDown, true); return () => window.removeEventListener('keydown', onKeyDown, true); }, [layer.nodes, selectedEdgeIds, state.selectedRecipeNode]);
  const nodes = useMemo(() => {
    const connectedParamsByNode = new Map();
    for (const { toNode, toParam } of layer.parameterConnections) {
      if (!connectedParamsByNode.has(toNode)) connectedParamsByNode.set(toNode, new Set());
      connectedParamsByNode.get(toNode).add(toParam);
    }
    return layer.nodes.map(node => ({
      id: node.id, type: 'recipe', position: { x: node.x, y: node.y },
      width: node.width, height: node.height, measured: node.measured,
      selected: Boolean(node.selected || node.id === selectedNodeId),
      data: {
        node,
        connectedParams: connectedParamsByNode.get(node.id),
        previewing: node.id === previewNodeId,
        onDelete: () => removeNode(node.id),
      },
    }));
  }, [layer.nodes, layer.parameterConnections, selectedNodeId, previewNodeId]);
  const insertNode = (edgeId, type) => { const edge = layer.connections.find(item => mainEdgeId(item) === edgeId); if (!edge) return; const node = createGraphNode(type, layer.nodes.length); const input = insertionInput(type); if (!input) return; updateLayer(current => { const currentEdge = current.connections.find(item => mainEdgeId(item) === edgeId); const source = current.nodes.find(item => item.id === currentEdge?.from); const target = current.nodes.find(item => item.id === currentEdge?.to); if (!currentEdge || !source || !target) return current; const direction = target.x >= source.x ? 1 : -1; const shiftDistance = 280; const insertX = target.x === source.x ? target.x + direction * 140 : target.x; const shiftedNodes = current.nodes.map(item => { const shouldShift = direction > 0 ? item.x >= target.x - 4 : item.x <= target.x + 4; return shouldShift ? { ...item, x: item.x + direction * shiftDistance } : item; }); const insertedNode = { ...node, x: insertX, y: target.y }; return { ...current, nodes: [...shiftedNodes, insertedNode], connections: [...current.connections.filter(item => mainEdgeId(item) !== edgeId), { from: currentEdge.from, to: insertedNode.id, toPort: input[0] }, { from: insertedNode.id, to: currentEdge.to, toPort: currentEdge.toPort || 'input' }] }; }); setOpenEdgeId(null); setConnectionMenu(null); setState(current => ({ ...current, selectedRecipeNode: node.id })); };
  const insertNodeAtConnection = type => { const pending = connectionMenu; if (!pending) return; const input = connectionInput(type, pending.sourceType); if (!input) return; const node = createGraphNode(type, layer.nodes.length); const position = { x: Math.round(pending.position.x / 20) * 20, y: Math.round(pending.position.y / 20) * 20 }; updateLayer(current => { const source = current.nodes.find(item => item.id === pending.sourceId); if (!source) return current; const cleared = pending.startedEdge ? removeFlowEdge(current, pending.startedEdge) : current; return { ...cleared, nodes: [...cleared.nodes, { ...node, x: position.x, y: position.y }], connections: [...cleared.connections, { from: source.id, to: node.id, toPort: input[0] }] }; }); setConnectionMenu(null); setState(current => ({ ...current, selectedRecipeNode: node.id })); };
  const edges = useMemo(() => { const mainEdges = layer.connections.map(edge => ({ id: mainEdgeId(edge), source: edge.from, target: edge.to, sourceHandle: 'output', targetHandle: edge.toPort || 'input', type: 'insert', reconnectable: true, selectable: true, selected: selectedEdgeIds.has(mainEdgeId(edge)), data: { kind: 'main', candidates: insertableNodeTypes(layer, edge), openEdgeId, onToggle: id => setOpenEdgeId(current => current === id ? null : id), onInsert: insertNode, onSelect: id => setSelectedEdgeIds(new Set([id])) } })); const parameterEdges = layer.parameterConnections.map(edge => ({ id: parameterEdgeId(edge), source: edge.fromNode, target: edge.toNode, sourceHandle: 'output', targetHandle: `param:${edge.toParam}`, type: 'smoothstep', className: 'rf-parameter-edge', reconnectable: true, selectable: true, selected: selectedEdgeIds.has(parameterEdgeId(edge)), data: { kind: 'parameter' } })); return [...mainEdges, ...parameterEdges]; }, [layer, layer.connections, layer.parameterConnections, openEdgeId, selectedEdgeIds]);
  const onNodesChange = changes => updateLayer(current => { const removedIds = new Set(changes.filter(change => change.type === 'remove' && !['background', 'output'].includes(current.nodes.find(node => node.id === change.id)?.type)).map(change => change.id)); const withoutRemoved = [...removedIds].reduce((nextLayer, id) => removeNodeAndReconnect(nextLayer, id), current); const remaining = withoutRemoved.nodes; const flowNodes = applyNodeChanges(changes.filter(change => change.type !== 'remove'), remaining.map(node => ({ id: node.id, position: { x: node.x, y: node.y }, width: node.width, height: node.height, measured: node.measured, selected: node.selected, data: node }))); return { ...withoutRemoved, nodes: flowNodes.map(node => { const source = withoutRemoved.nodes.find(item => item.id === node.id); const positionChange = changes.find(change => change.type === 'position' && change.id === node.id && change.position); const position = positionChange ? snapNodePosition(withoutRemoved.nodes, node.id, node.position) : node.position; return { ...source, x: position.x, y: position.y, width: node.width, height: node.height, measured: node.measured, selected: node.selected }; }) }; }, changes.some(change => ['remove', 'position'].includes(change.type)));
  const onEdgesChange = changes => { const selectionChanges = changes.filter(change => change.type === 'select'); if (selectionChanges.length) setSelectedEdgeIds(current => { const next = new Set(current); selectionChanges.forEach(change => change.selected ? next.add(change.id) : next.delete(change.id)); return next; }); const removals = changes.filter(change => change.type === 'remove'); if (!removals.length) return; updateLayer(current => removals.reduce((nextLayer, change) => removeFlowEdgeById(nextLayer, change.id), current), true); setSelectedEdgeIds(current => { const next = new Set(current); removals.forEach(change => next.delete(change.id)); return next; }); };
  const onEdgesDelete = deletedEdges => { if (!deletedEdges?.length) return; updateLayer(current => deletedEdges.reduce((nextLayer, edge) => removeFlowEdgeById(nextLayer, edge.id), current), true); setSelectedEdgeIds(current => { const next = new Set(current); deletedEdges.forEach(edge => next.delete(edge.id)); return next; }); };
  const onConnectStart = (_event, handle) => { connectionStartRef.current = occupiedEdgeForHandle(layer, handle); };
  const onConnect = connection => { const startedEdge = connectionStartRef.current; connectionStartRef.current = null; setConnectionMenu(null); const validationLayer = startedEdge ? removeFlowEdge(layer, startedEdge) : layer; const result = validateGraphConnection(validationLayer, connection); if (!result.valid) { setValidation(result.message); return; } setValidation(''); updateLayer(current => { const cleared = startedEdge ? removeFlowEdge(current, startedEdge) : current; if ((connection.targetHandle || '').startsWith('param:')) return { ...cleared, parameterConnections: [...cleared.parameterConnections.filter(edge => !(edge.toNode === connection.target && edge.toParam === connection.targetHandle.slice(6))), { fromNode: connection.source, fromPort: connection.sourceHandle, toNode: connection.target, toParam: connection.targetHandle.slice(6) }] }; return { ...cleared, connections: [...cleared.connections.filter(edge => !(edge.to === connection.target && (edge.toPort || 'input') === (connection.targetHandle || 'input'))), { from: connection.source, to: connection.target, toPort: connection.targetHandle || 'input' }] }; }); };
  const onConnectEnd = (event, connectionState) => { const startedEdge = connectionStartRef.current; connectionStartRef.current = null; const sourceId = connectionState?.fromNode?.id; const source = layer.nodes.find(node => node.id === sourceId); const sourceType = source ? getPortType(source, 'output') : null; const candidates = source ? connectableNodeTypes(layer, source.id) : []; const droppedOnEmptySpace = connectionState?.isValid !== true && !connectionState?.toNode; if (droppedOnEmptySpace && source && candidates.length) { const clientPosition = 'clientX' in event ? { x: event.clientX, y: event.clientY } : null; const position = flow?.screenToFlowPosition && clientPosition ? flow.screenToFlowPosition(clientPosition) : connectionState?.to || connectionState?.pointer || { x: source.x + 280, y: source.y }; setOpenEdgeId(null); setValidation(''); setConnectionMenu({ sourceId: source.id, sourceType, position, candidates, startedEdge }); return; } if (startedEdge && connectionState?.isValid === false) updateLayer(current => removeFlowEdge(current, startedEdge)); };
  const onReconnect = (oldEdge, connection) => { const validationLayer = removeFlowEdge(layer, oldEdge); const result = validateGraphConnection(validationLayer, connection); if (!result.valid) { setValidation(result.message); return; } setValidation(''); updateLayer(current => { const cleared = removeFlowEdge(current, oldEdge); if ((connection.targetHandle || '').startsWith('param:')) return { ...cleared, parameterConnections: [...cleared.parameterConnections.filter(edge => !(edge.toNode === connection.target && edge.toParam === connection.targetHandle.slice(6))), { fromNode: connection.source, fromPort: connection.sourceHandle, toNode: connection.target, toParam: connection.targetHandle.slice(6) }] }; return { ...cleared, connections: [...cleared.connections.filter(edge => !(edge.to === connection.target && (edge.toPort || 'input') === (connection.targetHandle || 'input'))), { from: connection.source, to: connection.target, toPort: connection.targetHandle || 'input' }] }; }); };
  const onReconnectEnd = (_event, oldEdge, _handleType, connectionState) => { if (connectionState?.isValid === false) { setValidation(''); updateLayer(current => removeFlowEdge(current, oldEdge)); } };
  const addableNodeTypes = graphNodeTypes.filter(type => !['background', 'output'].includes(type));
  const addNode = type => { const node = createGraphNode(type, layer.nodes.length); updateLayer(current => ({ ...current, nodes: [...current.nodes, node] })); setState(current => ({ ...current, selectedRecipeNode: node.id })); };
  return <section className="designer-workspace"><div className="designer-workspace-head"><div><span className="eyebrow">Recipe authoring</span><p className="preview-scene-name">Active scene · {sceneName}</p><h2>{recipeDocument.name || 'Recipe graph'}</h2><small className="designer-context">Drag to select multiple nodes. Hold Space while dragging to pan. Nodes snap to the grid and nearby edges or centers.</small></div><RecipeLibraryControls state={state} setState={setState} /></div>{validation && <div className="designer-graph-validation">{validation}</div>}<div className="designer-flow-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} snapToGrid snapGrid={[20, 20]} panOnDrag={interactionMode === 'pan'} nodesDraggable={interactionMode === 'select'} panActivationKeyCode="Space" selectionOnDrag={interactionMode === 'select'} selectionMode={SelectionMode.Partial} selectionKeyCode={null} onInit={setFlow} onNodeClick={(_, node) => { setSelectedEdgeIds(new Set()); setState(current => ({ ...current, selectedRecipeNode: node.id })); }} onEdgeClick={(_, edge) => setSelectedEdgeIds(new Set([edge.id]))} onPaneClick={event => { setOpenEdgeId(null); if (event.target?.classList?.contains('react-flow__pane')) setSelectedEdgeIds(new Set()); setState(current => ({ ...current, selectedRecipeNode: null })); }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onEdgesDelete={onEdgesDelete} onConnectStart={onConnectStart} onConnect={onConnect} onConnectEnd={onConnectEnd} onReconnect={onReconnect} onReconnectEnd={onReconnectEnd} edgesReconnectable deleteKeyCode={['Backspace', 'Delete']} fitView><Background gap={20} size={1} color="var(--graph-grid-dot)" /><GraphToolbar interactionMode={interactionMode} onInteractionModeChange={setInteractionMode} categories={nodeCategories.filter(category => category.types.some(type => addableNodeTypes.includes(type)))} addableNodeTypes={addableNodeTypes} onAdd={addNode} onUndo={undo} onRedo={redo} canUndo={Boolean(historyRef.current.past.length)} canRedo={Boolean(historyRef.current.future.length)} /><Controls showZoom showFitView showInteractive /><ConnectionAddMenu menu={connectionMenu} onInsert={insertNodeAtConnection} onClose={() => setConnectionMenu(null)} /><Panel position="top-right" className="rf-inspector-panel"><RecipeInspector layer={layer} selectedNodeId={selectedNodeId} onUpdate={updateNodeParams} /></Panel><Panel position="bottom-right" className="rf-preview-panel"><RecipePreview playback={playback} recipeDocument={recipeDocument} layer={layer} sceneDocument={sceneDocument} previewNodeId={previewNodeId} selectedNodeId={selectedNodeId} previewMode={previewMode} lockedNodeId={lockedNodeId} onPreviewModeChange={setPreviewMode} onToggleCurrentLock={setLockedNodeId} /></Panel></ReactFlow></div></section>;
}
