import { useEffect, useMemo, useRef } from 'react';
import { createSceneDocument, ensureSceneDocument } from '../engine/scene-document';
import { ensureRecipeDocument } from '../engine/recipe-document';
import { RenderEngine } from '../engine/render-engine';
import { applyRecipeToSceneDocument } from '../engine/recipe-bridge';

export function RecipeThumbnail({ recipeDocument, className = '' }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const sceneDocument = useMemo(() => applyRecipeToSceneDocument(createSceneDocument(), ensureRecipeDocument(recipeDocument)), [recipeDocument]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    try {
      engineRef.current = new RenderEngine(canvas);
      engineRef.current.render(ensureSceneDocument(sceneDocument), 0);
    } catch {
      engineRef.current = null;
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [sceneDocument]);

  return <canvas ref={canvasRef} className={`recipe-thumbnail ${className}`} aria-hidden="true" />;
}
