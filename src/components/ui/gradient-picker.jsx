import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from './button';
import { ColorPicker } from './color-picker';
import { cn } from '../../lib/utils';

const gradientDefaults = { from: '#172426', to: '#D8F27B', angle: 90, fromPosition: 0, toPosition: 100 };
const gradientPresets = [
  { name: 'Aurora', from: '#172426', to: '#D8F27B', angle: 120 },
  { name: 'Tide', from: '#10282D', to: '#3D8087', angle: 90 },
  { name: 'Ember', from: '#2B1515', to: '#F97316', angle: 35 },
  { name: 'Dusk', from: '#21162D', to: '#C026D3', angle: 110 },
];

function GradientStopRail({ gradient, selected, onSelect, onMove }) {
  const ref = useRef(null);
  const update = (stop, event) => {
    const rect = ref.current.getBoundingClientRect();
    onSelect(stop);
    onMove(stop, Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  };
  const begin = (stop, event) => { event.currentTarget.setPointerCapture(event.pointerId); update(stop, event); };
  const css = `linear-gradient(90deg, ${gradient.from} ${gradient.fromPosition}%, ${gradient.to} ${gradient.toPosition}%)`;
  return <div ref={ref} className="gradient-stop-rail" style={{ background: css }}>
    <span className={cn('gradient-stop-handle', selected === 'from' && 'selected')} style={{ left: `${gradient.fromPosition}%`, background: gradient.from }} onPointerDown={event => begin('from', event)} onPointerMove={event => event.buttons && update('from', event)} />
    <span className={cn('gradient-stop-handle', selected === 'to' && 'selected')} style={{ left: `${gradient.toPosition}%`, background: gradient.to }} onPointerDown={event => begin('to', event)} onPointerMove={event => event.buttons && update('to', event)} />
  </div>;
}

export function GradientPicker({ value = gradientDefaults, onChange, className, showAngle = true }) {
  const [open, setOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState('from');
  const [draft, setDraft] = useState({ ...gradientDefaults, ...value });
  const rootRef = useRef(null);
  const gradient = { ...gradientDefaults, ...value, ...draft };

  useEffect(() => setDraft({ ...gradientDefaults, ...value }), [value?.from, value?.to, value?.angle, value?.fromPosition, value?.toPosition]);
  useEffect(() => {
    if (!open) return undefined;
    const root = rootRef.current;
    const stopInside = event => event.stopPropagation();
    const outside = event => { if (!root?.contains(event.target)) setOpen(false); };
    const escape = event => event.key === 'Escape' && setOpen(false);
    root?.addEventListener('pointerdown', stopInside, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { root?.removeEventListener('pointerdown', stopInside, true); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  const update = patch => { const next = { ...gradient, ...patch }; setDraft(next); onChange?.(next); };
  const cssGradient = `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})`;
  const selectedColor = selectedStop === 'from' ? gradient.from : gradient.to;

  return <div ref={rootRef} className={cn('gradient-picker', className)}>
    <Button type="button" variant="outline" className="gradient-picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)}><span className="gradient-picker-trigger-preview" style={{ background: cssGradient }} /><span>Gradient</span><ChevronDown size={14} className="color-picker-chevron" /></Button>
    {open && <div className="gradient-picker-popover" role="dialog" aria-label="Choose gradient">
      <div className="gradient-picker-preview" style={{ background: cssGradient }}>{showAngle && <span>{gradient.angle}°</span>}</div>
      <GradientStopRail gradient={gradient} selected={selectedStop} onSelect={setSelectedStop} onMove={(stop, position) => update({ [stop === 'from' ? 'fromPosition' : 'toPosition']: position })} />
      {showAngle && <div className="gradient-picker-angle"><span>Angle</span><input type="range" min="0" max="360" value={gradient.angle} onChange={event => update({ angle: Number(event.target.value) })} /><output>{gradient.angle}°</output></div>}
      <div className="gradient-picker-selected-stop"><span className="gradient-stop-label">{selectedStop === 'from' ? 'Start color' : 'End color'}</span><ColorPicker value={selectedColor} onChange={color => update({ [selectedStop === 'from' ? 'from' : 'to']: color })} /></div>
      <div className="gradient-picker-presets">{gradientPresets.map(preset => <button type="button" key={preset.name} className="gradient-picker-preset" onClick={() => update(preset)}><span style={{ background: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})` }} />{preset.name}</button>)}</div>
    </div>}
  </div>;
}

export function GradientPickerDemo() { const [gradient, setGradient] = useState(gradientDefaults); return <main className="color-picker-demo"><div className="color-picker-demo-heading"><span className="eyebrow">Component preview</span><h1>Gradient picker</h1><p>Build a two-color gradient for your display layer.</p></div><div className="color-picker-demo-card"><div className="field"><span>Gradient</span><GradientPicker value={gradient} onChange={setGradient} /></div></div></main>; }
